# ───────────────────────────────────────────────────────────────
#  Backend – Node + Express (runs as UID 33 / GID 33)
# ───────────────────────────────────────────────────────────────
FROM node:23-alpine3.20

# Runtime extras
RUN apk add --no-cache git bash

# ── Give UID 33 a writable $HOME so Git can create ~/.gitconfig ──
RUN mkdir -p /home/www-data && chown 33:33 /home/www-data
ENV HOME=/home/www-data

WORKDIR /app
COPY ./CODE .

# Install dependencies with an immutable lock-file workflow
COPY CODE/package*.json ./
#RUN npm 

# Copy application source, making it owned by UID 33 inside the image
COPY --chown=33:33 CODE/ .

# Run everything as www-data (UID 33 / GID 33)
USER 33:33

EXPOSE 5000
CMD ["sh", "-c", "npm install && npm run dev"]
