# Runtime stage - just a simple nginx to serve static files
FROM nginx:alpine

# Delete the default nginx content
RUN rm -rf /usr/share/nginx/html
RUN mkdir -p /usr/share/nginx/html/public

# Copy the built assets
# COPY --from=builder /app/public /usr/share/nginx/html/public

# Use a simple nginx config that handles wildcard routes
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
