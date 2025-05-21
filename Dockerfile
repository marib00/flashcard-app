FROM ubuntu:24.04

# Set DEBIAN_FRONTEND to noninteractive to avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies: Node.js, npm, Python, pip, python3-venv, curl, lsof, git
RUN apt-get update && \
    apt-get install -y curl lsof git python3 python3-pip python3-venv nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy all application files
# This includes backend/, frontend/, start.sh, and any other necessary files
COPY . /app/

# Make setup and start scripts executable
RUN chmod +x /app/backend/setup.sh && \
    chmod +x /app/frontend/setup.sh && \
    chmod +x /app/start.sh

# Run backend setup
RUN /app/backend/setup.sh

# Run frontend setup
RUN /app/frontend/setup.sh

# Expose ports
EXPOSE 3000
EXPOSE 8000

# Command to run the application
CMD ["/app/start.sh"] 