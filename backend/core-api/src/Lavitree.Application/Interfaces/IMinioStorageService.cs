using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Lavitree.Application.Interfaces;

public interface IMinioStorageService
{
    Task EnsureBucketExistsAsync(string bucketName, CancellationToken cancellationToken = default);
    Task<string> UploadFileAsync(string bucketName, string objectName, Stream stream, string contentType, CancellationToken cancellationToken = default);
    string GetPublicUrl(string bucketName, string objectName);
}
