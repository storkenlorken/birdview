# 🐦 BirdView

### Ever wondered where all your storage went?
BirdView is a snappy, macOS-inspired dashboard that helps you hunt down space-hogs on your Unraid server (or any home server). It scans your drives, categorizes your junk, and tracks how your storage grows over time.

![BirdView Dashboard](https://raw.githubusercontent.com/storkenlorken/birdview/main/screenshots/dashboard.png)

*   Written in Go, so it rips through millions of files in a few minutes.
*   A nice frosted glass UI that looks pretty good.
*   See exactly how much your "Backups" folder grew since last month.
*   Just one Docker container. No complex setup, no external databases.

## Get it running

### Docker (current method)
```bash
docker run -d \
  --name birdview \
  -p 8080:8080 \
  -v /mnt/user:/data:ro \
  -v birdview_data:/app/data \
  --restart always \
  storken/birdview
```

### Unraid (comming soon I hope)
1. Head to the **Apps** tab.
2. Search for `BirdView`.
3. Hit **Install** and you're done!

#### Configuration
*   **Storage to Scan**: Point this to whatever you want BirdView to analyze (default: `/mnt/user`).
*   **AppData**: This is where BirdView saves its history database. Keep this persistent so you don't lose your charts!
*   **Scan Interval**: Set how many days to wait between automatic scans. We recommend **7 days** to keep your drives happy.
*   **Web Port**: The port where you'll access the dashboard (default: `8080`).

### How Categorization Works
BirdView doesn't just look at extensions; it's a bit smarter than that. It uses two methods to group your files.

1.  **Smart Paths**: If a file is inside a folder named `Backups`, `TimeMachine`, or `Docker`, it's automatically tagged as **Backups** or **System**, regardless of what the file is.
2.  **File Types**: If the folder name doesn't give it away, it looks at the extension:
    *   **Video**: `.mp4`, `.mkv`, `.avi`, `.mov`, etc.
    *   **Audio**: `.mp3`, `.wav`, `.flac`, etc.
    *   **Images**: `.jpg`, `.png`, `.gif`, `.heic`, etc.
    *   **Archives**: `.zip`, `.tar`, `.iso`, `.dmg`, etc.
    *   **Documents**: `.pdf`, `.docx`, `.xlsx`, `.txt`, etc.
    *   **System**: `.db`, `.log`, `.json`, `.yaml`, etc.
    *   **Other**: Anything that doesn't fit the above!

### Docker Compose

```yaml
services:
  birdview:
    image: storken/birdview
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
