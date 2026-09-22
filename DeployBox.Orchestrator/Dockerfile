FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY DeployBox.Orchestrator.csproj ./
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app

# DockerBuildService shells out to the `docker` CLI against the mounted
# /var/run/docker.sock — the base runtime image doesn't ship it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && . /etc/os-release \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app .

ENTRYPOINT ["dotnet", "DeployBox.Orchestrator.dll"]
