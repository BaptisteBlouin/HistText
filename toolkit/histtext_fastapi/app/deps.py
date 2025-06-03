from pathlib import Path
from typing import Optional

from histtext_toolkit.core.config import Config, get_config, load_config
from histtext_toolkit.core.logging import setup_logging

def setup_config_and_logging(
    config_path: Optional[Path], log_level: str, solr_host: str, solr_port: int, cache_dir: Optional[Path]
) -> Config:
    setup_logging(log_level)
    if config_path:
        config = load_config(config_path)
    else:
        config = get_config()
    # Override
    if solr_host:
        config.solr.host = solr_host
    if solr_port:
        config.solr.port = solr_port
    if cache_dir:
        config.cache.root_dir = str(cache_dir)
    return config
