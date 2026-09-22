FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY DeployBox.Orchestrator.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app

# DockerBuildService shells out to the `docker` CLI against the mounted
# /var/run/docker.sock — the base runtime image doesn't ship it. Docker's
# apt repo doesn't have a release file for every Debian/Ubuntu codename
# this base image tracks, so pull the static CLI binary instead of using apt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) dockerArch=x86_64 ;; \
         arm64) dockerArch=aarch64 ;; \
         *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${dockerArch}/docker-27.3.1.tgz" -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker.tgz /tmp/docker

COPY --from=build /app .

ENTRYPOINT ["dotnet", "DeployBox.Orchestrator.dll"]
