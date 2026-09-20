FROM node:24-alpine AS web-build
WORKDIR /src/web

COPY src/AzureCostOptimizer.Web/package.json src/AzureCostOptimizer.Web/package-lock.json ./
RUN npm ci

COPY src/AzureCostOptimizer.Web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS app-build
WORKDIR /src

COPY src/AzureCostOptimizer.App/AzureCostOptimizer.App.csproj src/AzureCostOptimizer.App/packages.lock.json src/AzureCostOptimizer.App/
RUN dotnet restore src/AzureCostOptimizer.App/AzureCostOptimizer.App.csproj --locked-mode

COPY src/AzureCostOptimizer.App/ src/AzureCostOptimizer.App/
COPY config/aco-system-prompt.md config/aco-system-prompt.md
COPY config/optimization-knowledge.v1.json config/optimization-knowledge.v1.json
COPY ops/start-demo.ps1 ops/start-demo.ps1
COPY spec/intelligence-provider-guide.md spec/intelligence-provider-guide.md
COPY --from=web-build /src/AzureCostOptimizer.App/wwwroot/ src/AzureCostOptimizer.App/wwwroot/
RUN dotnet publish src/AzureCostOptimizer.App/AzureCostOptimizer.App.csproj --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=app-build /app/publish/ ./

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "AzureCostOptimizer.App.dll"]