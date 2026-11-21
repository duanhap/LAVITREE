FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/Lavitree.Domain/Lavitree.Domain.csproj", "src/Lavitree.Domain/"]
COPY ["src/Lavitree.Application/Lavitree.Application.csproj", "src/Lavitree.Application/"]
COPY ["src/Lavitree.Infrastructure/Lavitree.Infrastructure.csproj", "src/Lavitree.Infrastructure/"]
COPY ["src/Lavitree.Api/Lavitree.Api.csproj", "src/Lavitree.Api/"]

RUN dotnet restore "src/Lavitree.Api/Lavitree.Api.csproj"

COPY . .
WORKDIR "/src/src/Lavitree.Api"
RUN dotnet build "Lavitree.Api.csproj" -c Release -o /app/build
RUN dotnet publish "Lavitree.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# BUG-40: seeder cần thư mục seed (loài cây, bệnh, sản phẩm mẫu) cạnh Lavitree.Api.dll
COPY --from=build /src/seed ./seed

# BUG-46: image aspnet có sẵn user thường "app" (UID $APP_UID); cổng 8080 không cần quyền root
USER $APP_UID

EXPOSE 8080
ENTRYPOINT ["dotnet", "Lavitree.Api.dll"]
