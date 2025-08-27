using System;
using CampaignManager.Services.Services;                // UserService (impl)
using CampaignManager.Services.Services.Abstractions;  // IUserService (interface)
using Data.Models;                                     // CampaignManagerContext
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()   // REQUIRED for isolated worker
    .ConfigureServices(services =>
    {
        var cs = Environment.GetEnvironmentVariable("SqlConnectionString");

        // EF Core DbContext used by your Services layer
        services.AddDbContext<CampaignManagerContext>(opts => opts.UseSqlServer(cs));

        // Register your service so LoginFunction can get IUserService in its ctor
        services.AddScoped<IUserService, UserService>();
    })
    .Build();

host.Run();
