# Use the official Node.js image as a base
FROM node:16

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app's source code
COPY . .

# Expose the port your app listens on
EXPOSE 5000

# Command to start the app
CMD ["node", "server.js"]


