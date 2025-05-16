#!/usr/bin/env python3
"""Force GPU Memory Release.

This script attempts to forcibly free GPU memory by terminating processes
that might be holding onto GPU resources. Useful for recovering from CUDA
out-of-memory errors or orphaned processes that don't release GPU memory.
"""

import argparse
import os
import subprocess
import time


def list_gpu_processes() -> list[int]:
    """List all processes using the GPU.

    Uses nvidia-smi to identify processes utilizing GPU resources
    and displays detailed information about each process.

    Returns:
        List[int]: List of process IDs (PIDs) currently using the GPU

    """
    try:
        # Run nvidia-smi to get PIDs
        output = subprocess.check_output(["nvidia-smi", "--query-compute-apps=pid", "--format=csv,noheader"])
        pids = [int(pid) for pid in output.decode().strip().split("\n") if pid.strip()]

        print(f"Found {len(pids)} processes using GPU:")

        # Get more info about each process
        for pid in pids:
            try:
                process_info = subprocess.check_output(["ps", "-p", str(pid), "-o", "pid,ppid,user,%cpu,%mem,cmd"]).decode()
                print(process_info)
            except subprocess.SubprocessError:
                print(f"PID {pid} - Could not get process info")

        return pids
    except subprocess.SubprocessError as e:
        print(f"Error getting GPU processes: {e}")
        return []


def kill_process(pid: int, force: bool = False) -> bool:
    """Kill a process by its PID.

    Terminates a process using either SIGTERM (graceful) or
    SIGKILL (force), depending on the specified option.

    Args:
        pid: Process ID to terminate
        force: Whether to force kill with SIGKILL (9) instead of SIGTERM (15)

    Returns:
        bool: True if the process was successfully terminated, False otherwise

    """
    try:
        if force:
            print(f"Force killing process {pid} with SIGKILL")
            os.kill(pid, 9)  # SIGKILL
        else:
            print(f"Terminating process {pid} with SIGTERM")
            os.kill(pid, 15)  # SIGTERM
        return True
    except ProcessLookupError:
        print(f"Process {pid} not found")
        return False
    except PermissionError:
        print(f"Permission denied to kill process {pid}")
        return False
    except Exception as e:
        print(f"Error killing process {pid}: {e}")
        return False


def restart_display_manager() -> None:
    """Restart the display manager to release GPU resources.

    Attempts to identify and restart the active display manager.
    This will restart the X server, which will free GPU resources,
    but will also close all GUI applications. Use with caution.
    """
    print("\nWARNING: This will close all your applications and restart the GUI!")
    confirm = input("Are you sure you want to continue? (y/N): ")

    if confirm.lower() == "y":
        # Different distributions use different display managers
        display_managers = [
            "gdm",  # GNOME
            "lightdm",  # Ubuntu/Xubuntu
            "sddm",  # KDE
            "xdm",  # Basic X display manager
            "mdm",  # MATE
            "lxdm",  # LXDE
        ]

        # Try to determine which display manager is active
        try:
            active_dm = None
            for dm in display_managers:
                result = subprocess.run(
                    ["systemctl", "is-active", f"{dm}.service"],
                    capture_output=True,
                )
                if result.stdout.decode().strip() == "active":
                    active_dm = dm
                    break

            if active_dm:
                print(f"Restarting {active_dm} display manager...")
                subprocess.run(["sudo", "systemctl", "restart", f"{active_dm}.service"])
                print("Display manager restarted.")
            else:
                print("Could not determine active display manager.")
                print("You may need to manually restart your system.")
        except Exception as e:
            print(f"Error restarting display manager: {e}")
            print("You may need to manually restart your system.")
    else:
        print("Operation cancelled.")


def check_gpu_memory() -> tuple[int, int]:
    """Check current GPU memory usage.

    Queries the GPU for its current memory usage statistics
    using nvidia-smi.

    Returns:
        Tuple[int, int]: (used_memory, total_memory) in MB

    """
    try:
        output = subprocess.check_output(
            [
                "nvidia-smi",
                "--query-gpu=memory.used,memory.total",
                "--format=csv,noheader,nounits",
            ]
        )
        used, total = map(int, output.decode().strip().split(","))
        return used, total
    except subprocess.SubprocessError as e:
        print(f"Error checking GPU memory: {e}")
        return 0, 0


def free_gpu_memory(force: bool = False, restart_x: bool = False) -> None:
    """Try to free GPU memory by terminating processes.

    Main function that orchestrates the process of identifying and
    terminating GPU-using processes. First targets Python processes,
    then offers to terminate other processes if memory is still in use.

    Args:
        force: Whether to use SIGKILL instead of SIGTERM for immediate termination
        restart_x: Whether to offer restarting the X server if memory is still high

    """
    # Check initial memory usage
    used, total = check_gpu_memory()
    if total > 0:
        usage_pct = (used / total) * 100
        print(f"Current GPU memory usage: {used}MB / {total}MB ({usage_pct:.1f}%)")

    # Get processes using GPU
    pids = list_gpu_processes()

    if not pids:
        print("No GPU processes found.")
        return

    # First try Python processes that might be our target
    python_pids = []
    for pid in pids:
        try:
            cmdline = open(f"/proc/{pid}/cmdline").read()
            if "python" in cmdline:
                python_pids.append(pid)
        except (OSError, PermissionError):
            pass

    if python_pids:
        print(f"\nFound {len(python_pids)} Python processes using GPU.")
        for pid in python_pids:
            kill_process(pid, force)

    # Wait a moment and check memory again
    time.sleep(1)
    used_after, total_after = check_gpu_memory()
    if total_after > 0:
        usage_pct_after = (used_after / total_after) * 100
        print(f"\nGPU memory usage after killing Python processes: {used_after}MB / {total_after}MB ({usage_pct_after:.1f}%)")

    # If memory usage is still high, offer to kill all GPU processes
    if used_after > 1000:  # More than 1GB still in use
        print("\nSignificant GPU memory still in use.")

        # Option to kill all remaining GPU processes
        if len(pids) > len(python_pids):
            other_pids = [pid for pid in pids if pid not in python_pids]
            print(f"There are {len(other_pids)} other processes using the GPU.")

            if force:
                print("Forcefully terminating all GPU processes...")
                for pid in other_pids:
                    kill_process(pid, True)
            else:
                confirm = input("Do you want to terminate all GPU processes? (y/N): ")
                if confirm.lower() == "y":
                    for pid in other_pids:
                        kill_process(pid, False)

        # Check memory again
        time.sleep(1)
        used_final, total_final = check_gpu_memory()
        if total_final > 0:
            usage_pct_final = (used_final / total_final) * 100
            print(f"\nGPU memory usage after killing all GPU processes: {used_final}MB / {total_final}MB ({usage_pct_final:.1f}%)")

        # If memory is still high and restart_x option is enabled
        if used_final > 500 and restart_x:  # More than 500MB still in use
            print("\nSignificant GPU memory still allocated after killing processes.")
            restart_display_manager()

    print("\nGPU memory cleanup completed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Forcibly free GPU memory by terminating processes")
    parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="Force kill processes with SIGKILL instead of SIGTERM",
    )
    parser.add_argument(
        "-r",
        "--restart-x",
        action="store_true",
        help="Offer to restart X server if significant memory is still in use after killing processes",
    )

    args = parser.parse_args()

    print("GPU Memory Cleanup Utility")
    print("==========================")

    free_gpu_memory(args.force, args.restart_x)
