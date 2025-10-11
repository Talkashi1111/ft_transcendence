# Multi-Architecture Container Registry Setup

## Summary of Changes

### ✅ Updated GitHub Actions Workflow

The `.github/workflows/ci.yml` now has two jobs:

1. **CI Job** - Runs on all PRs and pushes

   - Lints, tests, and builds
   - Validates production image builds
   - Must pass before merge

2. **Deploy Job** - Only runs on main branch after CI passes
   - Builds multi-architecture images (AMD64 + ARM64)
   - Pushes to GitHub Container Registry
   - Tags: `latest`, `main`, `main-<sha>`

## How It Works

### On Pull Requests

```
Developer creates PR → CI job runs → Tests & builds → Ready for review
```

**No images are pushed** - only validation

### On Merge to Main

```
PR merged to main → CI job runs → Tests pass ✅ → Deploy job starts
                                                   ↓
                                    Build AMD64 + ARM64 images
                                                   ↓
                                    Push to ghcr.io with tags
                                                   ↓
                                    Done! Images ready to deploy
```

## Registry Configuration

### Default: GitHub Container Registry (GHCR)

**Advantages:**

- ✅ No setup required (uses `GITHUB_TOKEN`)
- ✅ Integrated with GitHub
- ✅ Free for public repos
- ✅ 500MB storage + 1GB transfer free for private repos
- ✅ Automatic authentication in GitHub Actions

**Image URLs:**

```
ghcr.io/talkashi1111/ft_transcendence:latest       # Always latest main
ghcr.io/talkashi1111/ft_transcendence:main         # Main branch
ghcr.io/talkashi1111/ft_transcendence:main-abc123  # Specific commit
```

### Optional: Docker Hub

If you prefer Docker Hub, follow these steps:

1. Create Docker Hub account and access token
2. Add GitHub secrets:
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`
3. Uncomment Docker Hub login in workflow
4. Update metadata to include Docker Hub images

## Multi-Architecture Details

### Platforms Built

- **linux/amd64** - Intel/AMD x86_64

  - Most cloud servers (AWS EC2, Azure VMs, Google Compute)
  - Most desktop computers
  - Traditional Linux servers

- **linux/arm64** - ARM64/aarch64
  - Apple Silicon Macs (M1, M2, M3, M4)
  - AWS Graviton instances (cost-effective)
  - Raspberry Pi 4/5
  - Modern ARM servers

### Build Process

Uses **Docker Buildx** with **QEMU** emulation:

1. QEMU enables cross-compilation on GitHub's AMD64 runners
2. Buildx creates multi-platform manifest
3. Docker automatically serves correct architecture

### Performance Notes

- **Native build** (same architecture): Fast
- **Cross-build** (emulated): Slower (~2-3x build time)
- **Pull time**: Same for both architectures
- **Runtime**: Native performance (no emulation when running)

## Deployment Examples

### Basic Deployment

```bash
# Pull latest image (auto-detects your architecture)
docker pull ghcr.io/talkashi1111/ft_transcendence:latest

# Run the backend server
docker run -d \
  --name ft-transcendence \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  ghcr.io/talkashi1111/ft_transcendence:latest
```

### With Environment Variables

```bash
docker run -d \
  --name ft-transcendence \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_HOST=0.0.0.0 \
  -v $(pwd)/data:/app/data \
  ghcr.io/talkashi1111/ft_transcendence:latest
```

### Using Docker Compose (Production)

Check `docker-compose.prod.yml` for production deployment configuration.

```bash
# Pull and start production stack
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ft-transcendence
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ft-transcendence
  template:
    metadata:
      labels:
        app: ft-transcendence
    spec:
      containers:
        - name: backend
          image: ghcr.io/talkashi1111/ft_transcendence:latest
          ports:
            - containerPort: 3000
          volumeMounts:
            - name: data
              mountPath: /app/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: ft-transcendence-data
```

## GitHub Container Registry Setup

### Making Images Public

By default, images are private. To make them public:

1. Go to your GitHub repo
2. Navigate to "Packages" (right sidebar)
3. Click on your package
4. Settings → Change visibility → Public

### Authentication for Private Images

**On GitHub Actions:** Automatic (uses `GITHUB_TOKEN`)

**On other machines:**

```bash
# Create a Personal Access Token (PAT) with read:packages scope
# Then login:
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Now you can pull private images
docker pull ghcr.io/talkashi1111/ft_transcendence:latest
```

### Clean Up Old Images

GitHub has storage limits. Set up automatic cleanup:

1. Go to Package settings
2. Enable "Delete old versions"
3. Configure retention policy (e.g., keep last 10 versions)

## Image Tags Explanation

| Tag          | Description             | When Updated        | Use Case                     |
| ------------ | ----------------------- | ------------------- | ---------------------------- |
| `latest`     | Most recent main branch | Every merge to main | Production (stable)          |
| `main`       | Current main branch     | Every merge to main | Same as latest               |
| `main-<sha>` | Specific commit         | Each commit to main | Rollback to specific version |

### Rollback Example

```bash
# Current production has issues, rollback to previous commit
docker pull ghcr.io/talkashi1111/ft_transcendence:main-abc123
docker stop ft-transcendence
docker rm ft-transcendence
docker run -d --name ft-transcendence ... :main-abc123
```

## Monitoring Builds

### View Build Progress

1. Go to your GitHub repo
2. Click "Actions" tab
3. Select the workflow run
4. Watch logs in real-time

### Build Times (Approximate)

- **CI Job**: 3-5 minutes

  - Lint: 30 seconds
  - Test: 1-2 minutes
  - Build: 1-2 minutes

- **Deploy Job**: 5-10 minutes
  - AMD64 build: 2-3 minutes
  - ARM64 build: 3-5 minutes (cross-compilation)
  - Push: 1-2 minutes

**Total**: ~8-15 minutes from merge to deployed image

### Caching

GitHub Actions cache significantly speeds up builds:

- First build: ~10-15 minutes
- Subsequent builds: ~5-8 minutes (with cache)

## Cost Considerations

### GitHub Container Registry

**Free tier:**

- Public repos: Unlimited
- Private repos: 500MB storage + 1GB transfer/month

**If you exceed limits:**

- Storage: $0.25/GB/month
- Transfer: $0.50/GB

### Build Minutes

**GitHub Actions free tier:**

- Public repos: Unlimited
- Private repos: 2,000 minutes/month

Multi-arch builds use ~10-15 minutes per deployment.

**If you exceed limits:**

- Additional minutes: $0.008/minute

### Optimization Tips

1. **Use cache** (already configured)
2. **Limit rebuilds** - Only push on main branch
3. **Clean up old images** - Delete unused tags
4. **Use buildx efficiently** - Parallel builds when possible

## Security Best Practices

### Image Scanning

Add vulnerability scanning to workflow:

```yaml
- name: Scan image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository }}:latest
    format: "table"
    exit-code: "1"
    severity: "CRITICAL,HIGH"
```

### Minimal Base Image

Already using `node:22-bookworm-slim` for production:

- ✅ Smaller attack surface
- ✅ Fewer vulnerabilities
- ✅ Faster deployments

### Non-Root User

Consider adding to production Dockerfile:

```dockerfile
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser
```

## Troubleshooting

### Build Fails on ARM64

**Symptom:** ARM64 build succeeds locally but fails in CI

**Solution:** QEMU emulation may timeout or fail on complex builds

- Increase timeout in workflow
- Use native ARM64 runners (GitHub-hosted ARM64 runners - coming soon)
- Accept AMD64-only initially

### Image Too Large

**Symptom:** Image size is too big (>1GB)

**Solutions:**

1. Review `.dockerignore` file
2. Use multi-stage builds (already doing this)
3. Clean up build artifacts
4. Consider Alpine base image

### Registry Push Fails

**Symptom:** "unauthorized" or "denied" errors

**Solutions:**

1. Check `GITHUB_TOKEN` has package write permissions
2. Verify repository visibility settings
3. Check package permissions

## Next Steps

### Recommended Additions

1. **Add image scanning** for security vulnerabilities
2. **Set up automatic rollback** on deployment failure
3. **Add health checks** in Docker Compose
4. **Configure monitoring** (Prometheus/Grafana)
5. **Add staging environment** with separate images

### Advanced: GitOps with ArgoCD

For Kubernetes deployments:

1. Store manifests in repo
2. ArgoCD watches for new images
3. Automatic rollout to cluster
4. Built-in rollback capabilities

## Resources

- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx Multi-platform](https://docs.docker.com/build/building/multi-platform/)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
