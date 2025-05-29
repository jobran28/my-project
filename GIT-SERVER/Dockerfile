# ───────────────────────────────────────────────────────────────
#  Git server over HTTP(S) via Apache + git-http-backend
# ───────────────────────────────────────────────────────────────
FROM debian:12.9

# Environment for git-http-backend
ENV GIT_PROJECT_ROOT=/srv/git \
    GIT_HTTP_EXPORT_ALL=1 \
    REMOTE_USER=git \
    GIT_ALLOW_PUSH=1

# Core packages
RUN apt-get update \
 && apt-get install -y apache2 apache2-utils git \
 && apt-get clean

# ── Ensure repo root exists and is owned by www-data (UID 33) ──
RUN install -d -o 33 -g 33 /srv/git

# ── Silence “dubious ownership” warnings for every repo under /srv/git ──
RUN git config --system --add safe.directory /srv/git

# Apache picks up our env vars at startup
RUN echo 'export APACHE_PID_FILE=/var/run/apache2/apache2.pid'            >> /etc/apache2/envvars \
 && echo 'export GIT_PROJECT_ROOT=/srv/git'                               >> /etc/apache2/envvars \
 && echo 'export GIT_HTTP_EXPORT_ALL=1'                                   >> /etc/apache2/envvars \
 && echo 'export REMOTE_USER=git'                                         >> /etc/apache2/envvars \
 && echo 'export GIT_ALLOW_PUSH=1'                                        >> /etc/apache2/envvars

# Virtual-host configuration for git-http-backend
COPY git.conf /etc/apache2/sites-available/000-default.conf

# Enable required Apache modules
RUN a2enmod cgi alias env

EXPOSE 80

# Lightweight init: start Apache then follow logs
CMD ["sh","-c","service apache2 start && tail -F /var/log/apache2/access.log /var/log/apache2/error.log"]
