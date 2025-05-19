"""Chinese Word Segmenter model implementation with adaptive hardware configuration.

This module provides an implementation of TokenizationModel using the ChineseWordSegmenter library
that automatically adapts to available hardware resources for optimal performance.
"""

import concurrent.futures
import logging
import os
import signal
import time
import warnings
from typing import Any

from ..core.logging import get_logger
from .base import Token, TokenizationModel

logger = get_logger(__name__)

# Try to import ChineseWordSegmenter without failing if unavailable
try:
    from chinese_word_segmenter import ChineseWordSegmenter

    CWSEG_AVAILABLE = True

    # Silence TensorFlow warnings and info messages
    try:
        import tensorflow as tf

        tf.get_logger().setLevel(logging.ERROR)
        os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
    except ImportError:
        pass
except ImportError:
    logger.warning("ChineseWordSegmenter not available. Install with `pip install git+https://github.com/hhhuang/ChineseWordSegmenter.git`")
    CWSEG_AVAILABLE = False


class ChineseSegmenterModel(TokenizationModel):
    """ChineseWordSegmenter implementation of tokenization model with hardware adaptation.

    This model automatically detects available hardware resources and configures itself
    for optimal performance on the detected platform, whether GPU or CPU.

    Attributes:
        is_loaded_flag (bool): Flag indicating if model is loaded
        num_models (int): Number of model instances for parallel processing
        batch_size (int): Batch size for processing
        parallel_workers (int): Number of parallel worker threads
        target_memory_usage (float): Target memory usage for GPU
        memory_safety_factor (float): Memory safety factor for model instances

    """

    def __init__(self, model_path: str = ""):
        """Initialize the ChineseWordSegmenter model.

        Args:
            model_path: Path is ignored as ChineseWordSegmenter uses built-in models.

        """
        self._model = None
        self._models = []
        self.is_loaded_flag = False
        self._token_cache = {}
        self.total_processed = 0
        self.total_tokens = 0
        self.total_time = 0
        self._reserve_tensor = None
        self._using_gpu = False

        # Default conservative settings that will be adjusted dynamically
        self.num_models = 1
        self.batch_size = 32
        self.parallel_workers = 4
        self.target_memory_usage = 0.70
        self.memory_safety_factor = 1.2

        # Set environment variables for better performance
        os.environ["TF_FORCE_GPU_ALLOW_GROWTH"] = "true"

        # Silence loggers
        self._silence_tensorflow_loggers()

    def _silence_tensorflow_loggers(self):
        """Silence TensorFlow and related loggers to reduce noise."""
        for logger_name in [
            "tensorflow",
            "simpletransformers",
            "transformers",
            "pytorch_transformers",
            "chinese_word_segmenter",
        ]:
            logging.getLogger(logger_name).setLevel(logging.ERROR)

        warnings.simplefilter(action="ignore", category=FutureWarning)
        warnings.simplefilter(action="ignore", category=UserWarning)

    def _detect_hardware_capabilities(self):
        """Detect available hardware capabilities and collect system information.

        Returns:
            dict: Dictionary containing hardware information

        """
        hardware_info = {
            "gpu_available": False,
            "gpu_memory_gb": 0,
            "cpu_count": os.cpu_count() or 4,
        }

        # Check for GPU with PyTorch
        try:
            import torch

            if torch.cuda.is_available():
                hardware_info["gpu_available"] = True
                device = torch.cuda.current_device()
                hardware_info["gpu_name"] = torch.cuda.get_device_name(device)
                total_memory = torch.cuda.get_device_properties(device).total_memory
                hardware_info["gpu_memory_gb"] = total_memory / (1024**3)

                logger.info(f"GPU detected: {hardware_info['gpu_name']} with {hardware_info['gpu_memory_gb']:.2f} GB memory")
            else:
                logger.info("No GPU detected, will use CPU only")
        except ImportError:
            # PyTorch not available, check for TensorFlow
            try:
                import tensorflow as tf

                gpus = tf.config.experimental.list_physical_devices("GPU")
                if gpus:
                    hardware_info["gpu_available"] = True
                    hardware_info["gpu_name"] = f"TensorFlow GPU ({len(gpus)} devices)"
                    logger.info(f"GPU detected through TensorFlow: {len(gpus)} devices")
                else:
                    logger.info("No GPU detected through TensorFlow, will use CPU only")
            except ImportError:
                logger.info("Neither PyTorch nor TensorFlow available, will use CPU only")

        # Log CPU info
        logger.info(f"CPU cores detected: {hardware_info['cpu_count']}")

        return hardware_info

    def load(self) -> bool:
        """Load the ChineseWordSegmenter model with graceful interrupt handling.

        Detects hardware capabilities and configures the model accordingly, handles
        CTRL+C gracefully during model loading, and initializes multiple model
        instances for parallel processing if appropriate.

        Returns:
            bool: True if model loaded successfully, False otherwise

        """
        if not CWSEG_AVAILABLE:
            logger.error("ChineseWordSegmenter is not installed")
            return False

        try:
            # Detect hardware capabilities
            hardware = self._detect_hardware_capabilities()

            # Initialize configuration based on hardware
            self._configure_for_hardware(hardware)

            # Initialize the first model and measure memory
            logger.info("Initializing ChineseWordSegmenter model for memory measurement...")

            # Initialize the first model
            self._model = ChineseWordSegmenter()
            self._models = [self._model]

            # Warm up with sample text
            sample_text = "这是一个测试文本，用于预热中文分词模型。"

            start_time = time.time()
            _ = self._model.tokenize(sample_text)
            warm_up_time = time.time() - start_time
            logger.info(f"Initial model warm-up took {warm_up_time:.2f} seconds")

            # Measure GPU memory usage if available
            model_memory = 0
            if hardware["gpu_available"]:
                try:
                    # Use our improved memory measurement function
                    model_memory = self._measure_model_memory()

                    if model_memory > 0:
                        # Get total available memory
                        import torch

                        total_memory = torch.cuda.get_device_properties(0).total_memory

                        # Calculate optimal configuration
                        self._configure_gpu_parameters(total_memory, model_memory)

                        # Clean up for actual loading
                        del self._model
                        self._models = []
                        torch.cuda.empty_cache()

                        # Set GPU as active
                        self._using_gpu = True
                    else:
                        logger.warning("Memory measurement returned zero, falling back to estimates")
                        # Fallback to estimates based on total memory
                        import torch

                        total_memory = torch.cuda.get_device_properties(0).total_memory

                        # Estimate as percentage of total memory based on GPU size
                        total_memory_gb = total_memory / (1024**3)
                        if total_memory_gb < 8:
                            estimate_percentage = 0.15  # 15% for small GPUs
                        elif total_memory_gb < 16:
                            estimate_percentage = 0.10  # 10% for medium GPUs
                        else:
                            estimate_percentage = 0.05  # 5% for large GPUs

                        model_memory = int(total_memory * estimate_percentage)
                        logger.warning(f"Using estimated memory footprint: {model_memory/1024**2:.2f}MB")

                        # Configure with estimated memory
                        self._configure_gpu_parameters(total_memory, model_memory)

                        # Clean up for actual loading
                        del self._model
                        self._models = []
                        torch.cuda.empty_cache()

                        # Set GPU as active
                        self._using_gpu = True
                except Exception as e:
                    logger.warning(f"Could not measure GPU memory usage: {e}")
                    # Fall back to CPU configuration
                    self._configure_for_cpu(hardware["cpu_count"])
                    self._using_gpu = False

                    # Clean up
                    del self._model
                    self._models = []
            else:
                # Configure for CPU
                self._configure_for_cpu(hardware["cpu_count"])
                self._using_gpu = False

                # Clean up
                del self._model
                self._models = []

            # Initialize the models - with interrupt handling
            logger.info(f"Initializing {self.num_models} ChineseWordSegmenter model{'s' if self.num_models > 1 else ''}...")

            self._models = []
            try:
                # Set up interrupt handler
                original_sigint = signal.getsignal(signal.SIGINT)

                def sigint_handler(sig, frame):
                    logger.info("Received CTRL+C, cleaning up...")
                    # Clean up any models already loaded
                    for model in self._models:
                        del model
                    self._models = []
                    # Restore original handler and re-raise interrupt
                    signal.signal(signal.SIGINT, original_sigint)
                    raise KeyboardInterrupt("User interrupted model loading")

                # Set custom interrupt handler
                signal.signal(signal.SIGINT, sigint_handler)

                # Create models
                for i in range(self.num_models):
                    try:
                        model = ChineseWordSegmenter()

                        # Try to optimize the model's behavior if possible
                        if hasattr(model, "model") and hasattr(model.model, "args"):
                            try:
                                # Set batch size parameters
                                batch_size_per_model = max(16, self.batch_size // self.num_models)
                                model.model.args.train_batch_size = batch_size_per_model
                                model.model.args.eval_batch_size = batch_size_per_model

                                # Enable mixed precision if available
                                if hasattr(model.model.args, "fp16"):
                                    model.model.args.fp16 = True
                            except Exception as e:
                                logger.warning(f"Could not set model parameters: {e}")

                        self._models.append(model)

                        # Report progress for multiple models
                        if self.num_models > 4 and (i + 1) % 4 == 0:
                            logger.info(f"Loaded {i+1}/{self.num_models} models...")

                    except Exception as e:
                        logger.warning(f"Error creating model instance {i+1}: {e}")
                        # If we couldn't create all models, adjust num_models
                        if self._models:
                            self.num_models = len(self._models)
                            logger.info(f"Adjusted to {self.num_models} model instances due to errors")
                        break

                # Restore original signal handler
                signal.signal(signal.SIGINT, original_sigint)

            except KeyboardInterrupt:
                logger.warning("Model loading interrupted by user")
                # Ensure we clean up properly
                for model in self._models:
                    del model
                self._models = []
                return False

            # Set main model reference
            self._model = self._models[0] if self._models else None

            if not self._model:
                logger.error("No models could be initialized")
                return False

            # Warm up all models with a sample text
            logger.info("Warming up ChineseWordSegmenter models...")
            start_time = time.time()

            # Setup interrupt handler for warmup phase
            try:
                original_sigint = signal.getsignal(signal.SIGINT)

                def warmup_sigint_handler(sig, frame):
                    logger.info("Received CTRL+C, interrupting warm-up...")
                    signal.signal(signal.SIGINT, original_sigint)
                    raise KeyboardInterrupt("User interrupted model warm-up")

                signal.signal(signal.SIGINT, warmup_sigint_handler)

                for i, model in enumerate(self._models):
                    _ = model.tokenize(sample_text)

                    # Report progress for multiple models
                    if self.num_models > 4 and (i + 1) % 4 == 0:
                        logger.info(f"Warmed up {i+1}/{self.num_models} models...")

                # Restore original signal handler
                signal.signal(signal.SIGINT, original_sigint)

            except KeyboardInterrupt:
                logger.warning("Model warm-up interrupted by user")
                self.is_loaded_flag = True  # Still consider loaded but not fully warmed up

                # Log partial warm-up
                warm_up_time = time.time() - start_time
                logger.info(f"Partial model warm-up completed in {warm_up_time:.2f} seconds")

                # Continue with configuration
            else:
                # Normal completion of warm-up
                warm_up_time = time.time() - start_time
                logger.info(f"Models warmed up in {warm_up_time:.2f} seconds")

            # Configure GPU memory if available
            if hardware["gpu_available"]:
                try:
                    import torch

                    if torch.cuda.is_available():
                        # Set memory fraction for PyTorch
                        torch.cuda.empty_cache()
                        torch.cuda.set_per_process_memory_fraction(self.target_memory_usage, 0)
                        logger.info(f"Configured GPU to use up to {self.target_memory_usage * 100:.0f}% of available memory")
                except Exception as e:
                    logger.warning(f"Could not configure GPU memory usage: {e}")

            self.is_loaded_flag = True

            # Log final configuration
            if self._using_gpu:
                logger.info(
                    f"Final configuration: {self.num_models} models, batch size {self.batch_size}, "
                    f"{self.parallel_workers} worker threads, {hardware['gpu_memory_gb']:.1f}GB GPU"
                )
            else:
                logger.info(
                    f"Final configuration: {self.num_models} models, batch size {self.batch_size}, "
                    f"{self.parallel_workers} worker threads, CPU-only mode"
                )

            return True
        except Exception as e:
            logger.error(f"Failed to load ChineseWordSegmenter: {e}")
            return False

    def _measure_model_memory(self):
        """Accurately measure the memory footprint of the model.

        Uses multiple measurement approaches to determine the model's memory usage
        and returns the median value with a safety margin.

        Returns:
            int: Measured memory in bytes

        """
        import torch

        if not torch.cuda.is_available():
            logger.warning("CUDA not available, cannot measure GPU memory")
            return 0

        # Initialize model if needed
        if self._model is None:
            self._model = ChineseWordSegmenter()

        # Empty cache and record baseline
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        baseline_allocated = torch.cuda.memory_allocated()
        baseline_reserved = torch.cuda.memory_reserved()

        logger.debug(f"Baseline memory - Allocated: {baseline_allocated/1024**2:.2f}MB, Reserved: {baseline_reserved/1024**2:.2f}MB")

        # Prepare texts of varying length to get better measurement
        sample_texts = [
            # Short text
            "这是测试用的短文本。",
            # Medium text
            "这是一个中等长度的文本，包含更多的字符。它应该能够帮助我们更准确地测量模型内存占用。",
            # Longer text
            "这是一个更长的文本示例，它有很多字符和句子，用于更全面地测试模型的内存使用情况。"
            "通过使用不同长度的文本，我们可以得到更准确的内存占用估计。这是因为模型在处理不同"
            "长度的输入时可能有不同的内存分配模式。长文本通常需要更多的内存来存储中间结果。",
        ]

        # Different measurement approaches
        measurement_results = []

        # Approach 1: Simple before/after with tracking reset
        try:
            torch.cuda.reset_peak_memory_stats()
            baseline = torch.cuda.memory_allocated()

            # Run the model on sample texts
            for text in sample_texts:
                _ = self._model.tokenize(text)

            after_allocation = torch.cuda.memory_allocated()
            memory_used = after_allocation - baseline

            if memory_used > 0:
                measurement_results.append(memory_used)
                logger.debug(f"Measurement approach 1: {memory_used/1024**2:.2f}MB")
        except Exception as e:
            logger.debug(f"Measurement approach 1 failed: {e}")

        # Approach 2: Use peak memory stats
        try:
            torch.cuda.reset_peak_memory_stats()
            baseline_peak = torch.cuda.max_memory_allocated()

            # Run the model on sample texts
            for text in sample_texts:
                _ = self._model.tokenize(text)

            peak_allocation = torch.cuda.max_memory_allocated()
            memory_peak = peak_allocation - baseline_peak

            if memory_peak > 0:
                measurement_results.append(memory_peak)
                logger.debug(f"Measurement approach 2: {memory_peak/1024**2:.2f}MB")
        except Exception as e:
            logger.debug(f"Measurement approach 2 failed: {e}")

        # Approach 3: Multiple runs with garbage collection
        try:
            gc_measurements = []
            for _ in range(3):  # Try 3 times
                torch.cuda.empty_cache()
                baseline = torch.cuda.memory_allocated()

                # Run on a single long text
                _ = self._model.tokenize(sample_texts[-1])

                after_allocation = torch.cuda.memory_allocated()
                memory_diff = after_allocation - baseline

                if memory_diff > 0:
                    gc_measurements.append(memory_diff)

                # Force garbage collection
                import gc

                gc.collect()
                torch.cuda.empty_cache()

            if gc_measurements:
                avg_gc_measurement = sum(gc_measurements) / len(gc_measurements)
                measurement_results.append(avg_gc_measurement)
                logger.debug(f"Measurement approach 3: {avg_gc_measurement/1024**2:.2f}MB")
        except Exception as e:
            logger.debug(f"Measurement approach 3 failed: {e}")

        # Calculate final result
        if measurement_results:
            # Use median to avoid outliers
            measurement_results.sort()
            if len(measurement_results) % 2 == 0:
                median_result = (measurement_results[len(measurement_results) // 2] + measurement_results[len(measurement_results) // 2 - 1]) / 2
            else:
                median_result = measurement_results[len(measurement_results) // 2]

            # Add a safety margin of 20%
            final_result = int(median_result * 1.2)

            logger.info(f"Model memory measurement successful: {final_result/1024**2:.2f}MB")
            return final_result
        else:
            # All measurement approaches failed
            logger.warning("All memory measurement approaches failed")
            return 0

    def _configure_gpu_parameters(self, total_memory: int, model_memory: int):
        """Configure parameters based on GPU memory measurements.

        Adjusts the number of model instances, batch size and worker thread count
        based on the detected GPU memory to optimize performance.

        Args:
            total_memory: Total GPU memory in bytes
            model_memory: Memory used by a single model in bytes

        """
        # Get total memory in GB for easier calculation
        total_memory_gb = total_memory / (1024**3)

        # Calculate model percentage of total memory
        model_percentage = model_memory / total_memory

        # Calculate usable memory
        usable_memory = total_memory * self.target_memory_usage

        # Calculate optimal number of model instances with the safety factor
        max_models = max(1, int(usable_memory / (model_memory * self.memory_safety_factor)))

        # Determine appropriate number of models based on model size
        if model_percentage > 0.20:
            # Very large models (>20% of GPU) - limit to 1-2 instances
            self.num_models = min(2, max(1, max_models))
            logger.info(f"Very large model detected ({model_percentage*100:.1f}% of GPU), limiting to {self.num_models} instances")
        elif model_percentage > 0.10:
            # Large models (10-20% of GPU) - limit to 4 instances
            self.num_models = min(4, max(1, max_models))
            logger.info(f"Large model detected ({model_percentage*100:.1f}% of GPU), limiting to {self.num_models} instances")
        elif model_percentage > 0.05:
            # Medium models (5-10% of GPU)
            self.num_models = min(8, max(2, max_models))
        elif model_percentage > 0.02:
            # Small models (2-5% of GPU)
            self.num_models = min(12, max(4, max_models))
        else:
            # Very small models (<2% of GPU)
            if total_memory_gb > 16:  # Very large GPU (>16GB)
                self.num_models = min(24, max(8, max_models))
            elif total_memory_gb > 8:  # Large GPU (8-16GB)
                self.num_models = min(16, max(8, max_models))
            else:  # Medium or small GPU
                self.num_models = min(8, max(4, max_models))

            logger.info(f"Very small model detected ({model_percentage*100:.1f}% of GPU), can use up to {self.num_models} instances")

        # Calculate batch size based on remaining memory
        memory_per_model = model_memory * self.num_models
        remaining_memory = usable_memory - memory_per_model

        # Adjust memory_per_batch_item based on model size
        if model_percentage > 0.15:  # Very large models
            memory_per_batch_item = model_memory * 0.2  # Each batch item needs more memory
        elif model_percentage > 0.05:  # Medium-large models
            memory_per_batch_item = model_memory * 0.15
        else:  # Small models
            memory_per_batch_item = model_memory * 0.1

        # Ensure memory_per_batch_item is not zero
        if memory_per_batch_item <= 0:
            memory_per_batch_item = model_memory * 0.1  # Fallback to 10% estimate

        # Estimate batch size
        estimated_batch_size = int(remaining_memory / memory_per_batch_item)

        # Apply reasonable limits based on model size
        if model_percentage > 0.15:  # Very large models
            self.batch_size = max(4, min(32, estimated_batch_size))
        elif model_percentage > 0.05:  # Medium-large models
            self.batch_size = max(8, min(64, estimated_batch_size))
        else:  # Small models
            self.batch_size = max(16, min(256, estimated_batch_size))

        # Set worker threads based on models and CPU cores
        cpu_count = os.cpu_count() or 4

        # Adjust worker threads based on model size
        if model_percentage > 0.15:  # Very large models - fewer threads
            self.parallel_workers = max(2, min(cpu_count // 2, self.num_models))
        else:  # Normal sized models
            self.parallel_workers = max(4, min(cpu_count, self.num_models * 2))

        logger.info(f"Model memory footprint: {model_memory / (1024**2):.2f} MB ({model_percentage*100:.1f}% of total GPU)")
        logger.info(f"GPU configuration: {self.num_models} models, batch size {self.batch_size}, {self.parallel_workers} worker threads")

    def _configure_for_cpu(self, cpu_count: int):
        """Configure parameters for CPU-only operation.

        Args:
            cpu_count: Number of CPU cores available

        """
        # For CPU, we use fewer model instances to avoid memory pressure
        self.num_models = max(1, min(2, cpu_count // 4))  # 1 model per 4 cores, max 2
        self.batch_size = 16  # Smaller batch size for CPU
        self.parallel_workers = max(2, min(cpu_count - 1, 4))  # Leave one core free for system

        logger.info(
            f"CPU-only configuration: {self.num_models} model{'s' if self.num_models > 1 else ''}, "
            f"batch size {self.batch_size}, {self.parallel_workers} worker threads"
        )

    def _configure_for_hardware(self, hardware: dict[str, Any]):
        """Configure initial parameters based on detected hardware.

        Args:
            hardware: Dictionary containing hardware information

        """
        if hardware["gpu_available"]:
            # Initial GPU configuration
            gpu_memory_gb = hardware["gpu_memory_gb"]

            if gpu_memory_gb > 16:  # High-end GPU (>16GB)
                self.target_memory_usage = 0.85
                self.memory_safety_factor = 1.2
            elif gpu_memory_gb > 8:  # Mid-range GPU (8-16GB)
                self.target_memory_usage = 0.80
                self.memory_safety_factor = 1.3
            elif gpu_memory_gb > 4:  # Low-end GPU (4-8GB)
                self.target_memory_usage = 0.75
                self.memory_safety_factor = 1.5
            else:  # Very low memory GPU (<4GB)
                self.target_memory_usage = 0.70
                self.memory_safety_factor = 2.0

            logger.info(
                f"Initial GPU configuration: target memory usage {self.target_memory_usage * 100:.0f}%, "
                f"safety factor {self.memory_safety_factor}x"
            )
        else:
            # CPU configuration will be set in _configure_for_cpu
            pass

    def free_gpu_memory(self) -> bool:
        """Release GPU memory used by the model.

        This is an aggressive method to ensure all memory is fully released.

        Returns:
            bool: True if successful, False otherwise

        """
        try:
            # Clear model references
            if hasattr(self, "_models") and self._models:
                for model in self._models:
                    if hasattr(model, "model"):
                        if hasattr(model.model, "model"):
                            # Handle nested model structures
                            del model.model.model
                        # Delete the model's model attribute
                        del model.model
                    # Delete the model itself
                    del model
                self._models = []

            self._model = None

            # Clear the token cache
            if hasattr(self, "_token_cache"):
                self._token_cache.clear()

            # Force garbage collection
            import gc

            gc.collect()

            # Force CUDA memory cleanup if available
            try:
                import torch

                if torch.cuda.is_available():
                    # Empty the cache
                    torch.cuda.empty_cache()

                    # More aggressive memory clearing
                    if hasattr(torch.cuda, "reset_peak_memory_stats"):
                        torch.cuda.reset_peak_memory_stats()

                    # Remove any tensors still in memory
                    for obj in gc.get_objects():
                        try:
                            if torch.is_tensor(obj):
                                if obj.is_cuda:
                                    obj.detach_()
                                    del obj
                        except Exception:
                            pass

                    # Call garbage collection again after cleaning tensors
                    gc.collect()
                    torch.cuda.empty_cache()

                    # Log memory usage after cleanup
                    memory_allocated = torch.cuda.memory_allocated() / (1024**3)
                    memory_reserved = torch.cuda.memory_reserved() / (1024**3)
                    logger.info(f"GPU memory after cleanup: Allocated: {memory_allocated:.2f} GB, " f"Reserved: {memory_reserved:.2f} GB")
            except ImportError:
                logger.debug("PyTorch not available, skipping GPU memory cleanup")

            # Try to force TensorFlow to release memory if it's being used
            try:
                import tensorflow as tf

                if hasattr(tf, "keras"):
                    tf.keras.backend.clear_session()
                if hasattr(tf, "reset_default_graph"):
                    tf.reset_default_graph()
                if hasattr(tf.compat.v1, "reset_default_graph"):
                    tf.compat.v1.reset_default_graph()
            except ImportError:
                logger.debug("TensorFlow not available, skipping TF memory cleanup")

            self.is_loaded_flag = False
            logger.info("Aggressively freed GPU memory")
            return True
        except Exception as e:
            logger.error(f"Error freeing GPU memory: {e}")
            return False

    def unload(self) -> bool:
        """Unload the ChineseWordSegmenter model from memory.

        Returns:
            bool: True if successful, False otherwise

        """
        try:
            # Release reserved tensor if any
            if self._reserve_tensor is not None:
                del self._reserve_tensor
                self._reserve_tensor = None

            # Log performance statistics
            if self.total_processed > 0:
                avg_time = self.total_time / self.total_processed if self.total_processed > 0 else 0
                avg_tokens = self.total_tokens / self.total_processed if self.total_processed > 0 else 0
                logger.info(f"ChineseWordSegmenter performance: processed {self.total_processed} texts")
                logger.info(f"Average processing time: {avg_time:.4f} seconds per text")
                logger.info(f"Average tokens per text: {avg_tokens:.2f}")

            # Use the enhanced memory cleanup method
            memory_freed = self.free_gpu_memory()

            logger.info("Unloaded ChineseWordSegmenter models")
            return memory_freed
        except Exception as e:
            logger.error(f"Error unloading ChineseWordSegmenter models: {e}")
            return False

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded.

        Returns:
            bool: True if the model is loaded, False otherwise

        """
        return self.is_loaded_flag and self._model is not None

    def _get_model_for_task(self, task_id=None):
        """Get a model instance for a specific task.

        Uses round-robin to distribute workload among models.

        Args:
            task_id: Optional task identifier for model selection

        Returns:
            Model instance to use for processing

        """
        if not self._models:
            return self._model

        if self.num_models == 1:
            return self._models[0]

        if task_id is None:
            # Use the total processed count as a simple round-robin method
            task_id = self.total_processed

        # Distribute tasks among models using modulo
        model_idx = task_id % len(self._models)
        return self._models[model_idx]

    def _process_text_to_tokens(self, text: str, task_id: int = None) -> list[Token]:
        """Process a single text to Token objects.

        Args:
            text: Input text to tokenize
            task_id: Optional task identifier for model selection

        Returns:
            List[Token]: List of extracted tokens

        """
        if not text or len(text) < 2:
            return []

        try:
            # Get the appropriate model for this task
            model = self._get_model_for_task(task_id)

            # Get segmented tokens
            tokens_text = model.tokenize(text)

            # Convert to Token objects with positions
            result_tokens = []
            current_pos = 0

            for token_text in tokens_text:
                # Skip empty tokens
                if not token_text:
                    continue

                # Find token in the original text
                start_pos = text.find(token_text, current_pos)

                if start_pos >= 0:
                    # Found the token in the text
                    end_pos = start_pos + len(token_text)
                    result_tokens.append(
                        Token(
                            text=token_text,
                            start_pos=start_pos,
                            end_pos=end_pos,
                            confidence=1.0,
                        )
                    )
                    current_pos = end_pos
                else:
                    # Token not found, might be punctuation or whitespace
                    # Skip it to avoid position issues
                    continue

            return result_tokens
        except Exception as e:
            logger.error(f"Error processing text to tokens: {e}")
            return []

    def tokenize_batch(self, texts: list[str]) -> list[list[Token]]:
        """Tokenize a batch of texts at once.

        Distributes the tokenization workload across multiple model instances
        if available and uses caching for performance.

        Args:
            texts: List of input texts to tokenize

        Returns:
            List[List[Token]]: List of token lists for each input text

        """
        if not self.is_loaded:
            if not self.load():
                return [[] for _ in texts]

        start_time = time.time()

        # Check cache first for each text
        results = []
        texts_to_process = []
        indices_to_process = []

        for i, text in enumerate(texts):
            if not text or len(text) < 2:
                results.append([])
                continue

            if text in self._token_cache:
                results.append(self._token_cache[text])
            else:
                results.append([])  # Placeholder
                texts_to_process.append(text)
                indices_to_process.append(i)

        # If nothing to process, return cached results
        if not texts_to_process:
            return results

        # Process uncached texts
        try:
            # Use ThreadPoolExecutor for parallel processing
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
                futures = {}
                for i, (idx, text) in enumerate(zip(indices_to_process, texts_to_process)):
                    futures[executor.submit(self._process_text_to_tokens, text, i)] = idx

                # Collect results as they complete
                for future in concurrent.futures.as_completed(futures):
                    try:
                        idx = futures[future]
                        tokens = future.result()
                        self._token_cache[texts_to_process[indices_to_process.index(idx)]] = tokens
                        results[idx] = tokens
                    except Exception as e:
                        logger.error(f"Error in tokenization: {e}")
        except Exception as e:
            logger.error(f"Error in batch tokenization: {e}")
            # Fallback to individual processing
            for i, text in zip(indices_to_process, texts_to_process):
                try:
                    tokens = self._process_text_to_tokens(text)
                    self._token_cache[text] = tokens
                    results[i] = tokens
                except Exception as e:
                    logger.error(f"Error tokenizing text: {e}")
                    results[i] = []

        # Update statistics
        processing_time = time.time() - start_time
        self.total_processed += len(texts_to_process)
        self.total_tokens += sum(len(tokens) for tokens in results)
        self.total_time += processing_time

        # Log progress periodically
        if self.total_processed % 50 == 0:
            avg_time = self.total_time / self.total_processed
            logger.info(f"Processed {self.total_processed} texts, avg time: {avg_time:.4f}s")

            # Log GPU memory usage if available
            try:
                import torch

                if torch.cuda.is_available():
                    device = torch.cuda.current_device()
                    allocated = torch.cuda.memory_allocated(device) / 1024**3
                    reserved = torch.cuda.memory_reserved(device) / 1024**3
                    logger.info(f"GPU Memory: Allocated {allocated:.2f} GB, Reserved {reserved:.2f} GB")
            except Exception:
                pass

        return results

    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text using ChineseWordSegmenter.

        Args:
            text: Input text to tokenize

        Returns:
            List[Token]: List of extracted tokens

        """
        # Process as a batch of 1 text
        results = self.tokenize_batch([text])
        return results[0] if results else []
