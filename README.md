# 🐦 BirdView

### Ever wondered where all your storage went?
BirdView is a snappy, macOS-inspired dashboard that helps you hunt down space-hogs on your Unraid server (or any home server). It scans your drives, categorizes your junk, and tracks how your storage grows over time.

![BirdView Screenshot](https://raw.githubusercontent.com/storkenlorken/birdview/main/screenshots/dashboard.png)

## Why you'll love it
*   **Fast as heck**: Written in Go, so it rips through millions of files in seconds.
*   **Eye Candy**: A beautiful frosted glass UI that actually looks good in 2024.
*   **Time Travel**: See exactly how much your "Backups" folder grew since last month.
*   **No Mess**: Just one Docker container. No complex setup, no external databases.

## Get it running

### Unraid (The easy way)
1. Head to the **Apps** tab.
2. Search for `BirdView`.
3. Hit **Install** and you're done!

#### Configuration
*   **Storage to Scan**: Point this to whatever you want BirdView to analyze (default: `/mnt/user`).
*   **AppData**: This is where BirdView saves its history database. Keep this persistent so you don't lose your charts!
*   **Scan Interval**: Set how many days to wait between automatic scans. We recommend **7 days** to keep your drives happy.
*   **Web Port**: The port where you'll access the dashboard (default: `8080`).

### Docker Compose
Just copy this into your `docker-compose.yml`:

```yaml
version: '3.8'
services:
  birdview:
    image: storkenlorken/birdview
    ports:
      - "8080:8080"
    volumes:
      - /mnt/user:/data:ro        # What you want to scan
      - ./appdata:/app/data       # Where to save history
    environment:
      - BIRDVIEW_SCAN_INTERVAL_DAYS=7
```

## License
MIT. Go wild.
