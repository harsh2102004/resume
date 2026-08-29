# VidTube Backend API

This is a robust, production-ready backend API built for a video streaming and sharing platform (similar to YouTube). It is designed to handle complex database relationships, secure file uploads, and scalable querying.

## 🚀 Key Features

- **User Authentication:** Secure JWT-based authentication (Access & Refresh tokens) with robust `bcrypt` password hashing.
- **Video Management:** Upload, publish, edit, and delete videos. Tracks video views and watch history.
- **Cloud Storage Integration:** Fully integrated with **Cloudinary** for scalable and secure image (avatars/covers) and video hosting.
- **User Interactions:** Robust support for comments, likes (on videos, tweets, and comments), and a complete channel subscription system.
- **Community Tweets:** Users can post and interact with "Tweets" (text-based community posts).
- **Playlists:** Users can create, update, and manage their own video playlists.
- **Creator Dashboard:** Advanced MongoDB aggregation pipelines to calculate channel statistics (total views, subscribers, likes, etc.).
- **Containerized:** Includes `Dockerfile` and `docker-compose.yml` for seamless, environment-agnostic deployment.

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB & Mongoose
- **File Handling:** Multer
- **Cloud Storage:** Cloudinary
- **Authentication:** JSON Web Tokens (JWT)
- **Containerization:** Docker

## ⚙️ Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harsh2102004/resume.git
   cd resume
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env` file in the root directory based on the `.env.sample` and configure your credentials:
   ```env
   PORT=8000
   MONGODB_URI=your_mongodb_connection_string
   CORS_ORIGIN=*
   ACCESS_TOKEN_SECRET=your_access_token_secret
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRY=10d
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   The API will be accessible at `http://localhost:8000`.

## 📦 API Architecture Overview

All API endpoints follow RESTful conventions and are prefixed with `/api/v1`.

- `/users`: Authentication, profile management, avatar updates, and watch history retrieval.
- `/videos`: Video uploading, querying, and deletion.
- `/tweets`: Community post management.
- `/subscriptions`: Channel subscriptions and subscriber querying.
- `/comments`: Add, edit, or delete comments on videos.
- `/likes`: Toggle likes on videos, comments, and tweets.
- `/playlist`: Create and manage playlists.
- `/dashboard`: Get channel statistics and videos.
- `/healthcheck`: Verify API health status.

## 🤝 Contribution
Contributions, issues, and feature requests are welcome!