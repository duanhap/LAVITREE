using Lavitree.Domain.Entities;

namespace Lavitree.Application.Interfaces;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}
