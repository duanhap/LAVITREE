using System;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Infrastructure.Persistence;
using Lavitree.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Lavitree.Api.Services;

/// <summary>Nạp lại danh mục chất cấm mỗi 10 phút: quyết định có ngày hiệu lực mới tới hạn sẽ tự áp dụng (TASK-19).</summary>
public sealed class BannedSubstanceRefreshService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BannedSubstanceRefreshService> _logger;

    public BannedSubstanceRefreshService(IServiceScopeFactory scopeFactory, ILogger<BannedSubstanceRefreshService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<LavitreeDbContext>();
                await BannedSubstanceRegistry.ReloadAsync(db, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Giữ danh sách đang có, không xóa trắng
                _logger.LogWarning("Không nạp lại được danh mục chất cấm: {Error}", ex.Message);
            }
        }
    }
}
