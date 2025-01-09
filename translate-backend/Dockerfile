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

# Copy the service account key file into the container
COPY service-account-key.json /usr/src/app/service-account-key.json

# Set the environment variable to point to the service account key
ENV GOOGLE_APPLICATION_CREDENTIALS="/usr/src/app/service-account-key.json"

# Expose the port your app listens on
EXPOSE 5000

# Command to start the app
CMD ["node", "server.js"]

