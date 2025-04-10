import multiprocessing

# Gunicorn configuration for Render
bind = "0.0.0.0:10000"
workers = 2  # Reduced number of workers to save memory
worker_class = "sync"
worker_connections = 1000
timeout = 120  # Increased timeout to 120 seconds
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
preload_app = True
capture_output = True
enable_stdio_inheritance = True
loglevel = "info"

# Calculate workers based on CPU cores (optional)
# workers = multiprocessing.cpu_count() * 2 + 1 