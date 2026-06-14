Enterprise Video Streaming Engine
A scalable backend architecture built to manage high-volume video content, user authentication, and complex data aggregation. Developed with a focus on security, performance, and modularity.

🛠 Tech Stack
Runtime: Node.js

Framework: Express.js

Database: MongoDB (with Mongoose ODM)

Authentication: JSON Web Tokens (JWT) (Access & Refresh Token rotation)

File Management: Multer (Middleware), Cloudinary (Cloud Storage)

API Documentation: Postman / REST API

Security: Bcrypt (Password Hashing), HTTP-Only Cookies, CORS

🚀 Key Features
Secure Auth System: Implemented stateless authentication using JWT. Handles access/refresh token rotation and secure storage via HTTP-Only cookies to prevent XSS/CSRF attacks.

Advanced Data Processing: Utilized MongoDB Aggregation Pipelines to perform complex database operations, including multi-stage joins ($lookup), pagination, and custom calculated fields.

Media Pipeline: Built a robust file-upload middleware using Multer for local buffering and integration with Cloudinary for scalable, cloud-based asset management.

Maintainable Architecture: Followed a strict MVC-like pattern (Controllers, Models, Middlewares, Routes) to ensure code reusability and clean API response wrappers.

Global Error Handling: Implemented a unified ApiError and ApiResponse class structure to standardize error reporting across all endpoints.

⚙️ System Architecture & Workflow


Middleware: verifyJWT middleware validates the cookie signature.

Controller: The controller processes the request, interacts with the MongoDB aggregation pipeline, and returns a sanitized JSON response.

Cleanup: Automated file system cleanup ensures temporary storage is cleared after Cloudinary upload success.

📥 Installation & Setup
Clone the repository:

Bash
git clone https://github.com/harsh2102004/resume
Install dependencies:

Bash
npm install
Configure environment variables in a .env file:

Code snippet
PORT=8000
MONGODB_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_name
# ... add other required vars
Run the server:

Bash
npm run dev
🛠 Future Scope
Caching: Implementing Redis to cache frequently accessed video metadata and reduce database hits.

Real-time Analytics: Integrating Socket.io for live view counting and notification systems.

Search Optimization: Implementing Elasticsearch for high-performance full-text search across video descriptions and user tags.
