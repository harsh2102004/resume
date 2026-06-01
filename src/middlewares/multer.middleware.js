import multer from "multer";

// Disk Storage configuration matrix setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Local staging area path specification
        cb(null, "./public/temp");
    },
    filename: function (req, file, cb) {
        // Keeping original name for basic local tracking (Can be replaced with unique ID suffix)
        cb(null, file.originalname);
    }
});

// Initializing multer instance with configured disk engine
export const upload = multer({ 
    storage // ES6 Shorthand notation
});