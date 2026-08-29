# Use an official Node runtime as a parent image
# Using alpine for a smaller image size
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (assuming 3000, you can change this if your app uses a different port)
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "dev"]
