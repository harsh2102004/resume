import { API_BASE_URL } from "../config/api";

export class TusUploader {
  constructor(file, options = {}) {
    this.file = file;
    this.endpoint = options.endpoint || `${API_BASE_URL}/api/v1/videos/resumable-upload`;
    this.chunkSize = options.chunkSize || 2 * 1024 * 1024;
    this.metadata = options.metadata || {};
    this.onProgress = options.onProgress || (() => {});
    this.onSuccess = options.onSuccess || (() => {});
    this.onError = options.onError || (() => {});

    this.uploadUrl = options.uploadUrl || null;
    this.headers = options.headers || {};
    this.offset = 0;
    this.isPaused = false;
    this.isAborted = false;
    this.currentXhr = null;
  }

  _encodeMetadata() {
    return Object.entries(this.metadata)
      .map(([key, val]) => `${key} ${btoa(unescape(encodeURIComponent(String(val))))}`)
      .join(",");
  }

  async start() {
    this.isPaused = false;
    this.isAborted = false;

    try {
      if (!this.uploadUrl) {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(this.file.size),
            "Upload-Metadata": this._encodeMetadata(),
            ...this.headers,
          },
        });

        if (response.status !== 201) {
          throw new Error(`Upload creation failed: HTTP ${response.status}`);
        }

        const location = response.headers.get("Location");
        if (!location) {
          throw new Error("Missing upload location header");
        }

        this.uploadUrl = location.startsWith("http")
          ? location
          : `${new URL(this.endpoint).origin}${location}`;

        this.offset = 0;
      } else {
        await this.syncOffset();
      }

      this._uploadNextChunk();
    } catch (err) {
      this.onError(err);
    }
  }

  async syncOffset() {
    const response = await fetch(this.uploadUrl, {
      method: "HEAD",
      headers: {
        "Tus-Resumable": "1.0.0",
      },
    });

    if (response.status === 200) {
      const serverOffset = response.headers.get("Upload-Offset");
      if (serverOffset !== null) {
        this.offset = parseInt(serverOffset, 10);
      }
    }
  }

  _uploadNextChunk() {
    if (this.isPaused || this.isAborted) return;

    if (this.offset >= this.file.size) {
      this.onProgress({ percentage: 100, loaded: this.file.size, total: this.file.size });
      this.onSuccess({ uploadUrl: this.uploadUrl });
      return;
    }

    const end = Math.min(this.offset + this.chunkSize, this.file.size);
    const chunk = this.file.slice(this.offset, end);

    const xhr = new XMLHttpRequest();
    this.currentXhr = xhr;

    xhr.open("PATCH", this.uploadUrl);
    xhr.setRequestHeader("Tus-Resumable", "1.0.0");
    xhr.setRequestHeader("Upload-Offset", String(this.offset));
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
    for (const [k, v] of Object.entries(this.headers)) {
      xhr.setRequestHeader(k, v);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const loaded = this.offset + e.loaded;
        const percentage = Math.min(100, Math.round((loaded / this.file.size) * 100));
        this.onProgress({ percentage, loaded, total: this.file.size });
      }
    };

    xhr.onload = () => {
      this.currentXhr = null;
      if (xhr.status === 204) {
        const newOffset = xhr.getResponseHeader("Upload-Offset");
        if (newOffset !== null) {
          this.offset = parseInt(newOffset, 10);
        } else {
          this.offset = end;
        }

        const percentage = Math.min(100, Math.round((this.offset / this.file.size) * 100));
        this.onProgress({ percentage, loaded: this.offset, total: this.file.size });

        this._uploadNextChunk();
      } else {
        this.onError(new Error(`Chunk upload failed with HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      this.currentXhr = null;
      this.onError(new Error("Network connection lost during chunk transfer"));
    };

    xhr.send(chunk);
  }

  pause() {
    this.isPaused = true;
    if (this.currentXhr) {
      this.currentXhr.abort();
      this.currentXhr = null;
    }
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.syncOffset().then(() => {
      this._uploadNextChunk();
    });
  }
}
