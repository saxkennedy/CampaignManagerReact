using System;
using Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SpaServices;
using Microsoft.AspNetCore.SpaServices.ReactDevelopmentServer;
using CampaignManager.Services.Abstractions;
using CampaignManager.Services;

namespace CampaignManager.WebApp
{
    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }
        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddControllersWithViews();
            services.AddHttpContextAccessor();
            services.AddHsts( options =>
            {
                options.Preload = true;
                options.IncludeSubDomains = true;
                options.MaxAge = TimeSpan.FromDays(30);
            });
            services.AddSpaStaticFiles(configuration =>
            {
                configuration.RootPath = "App/build";
            });
            services.AddDbContext<CampaignManagerContext>(options =>
                options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection"),
                builder => { builder.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null); }
                ));
            DbContextOptionsBuilder<CampaignManagerContext> builder = new DbContextOptionsBuilder<CampaignManagerContext>();
            builder.UseSqlServer(Configuration.GetConnectionString("DefaultConnection"));
            //store the connection string in a variable
            string? connectionString = Configuration.GetConnectionString("DefaultConnection");
            using (CampaignManagerContext context = new CampaignManagerContext(builder.Options))
            {
                context.Database.Migrate();
            }
            services.AddRazorPages();
            services.AddMemoryCache();
            AddLocalServices(services);
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }
            else
            {
                app.UseHsts();
            }
            app.UseHttpsRedirection();
            app.UseStaticFiles();    
            app.UseSpaStaticFiles();
            app.UseRouting();
            app.UseAuthorization();
            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllerRoute(
                    name: "default",
                    pattern: "{controller}/{action=Index}/{id?}");
                endpoints.MapRazorPages();
            });
            app.UseSpa(spa =>
            {
                spa.Options.SourcePath = "App";
                if (env.IsDevelopment())
                {
                    spa.Options.StartupTimeout = TimeSpan.FromSeconds(10000);
                    spa.UseReactDevelopmentServer(npmScript: "start");
                }
            });
        }

        private void AddLocalServices(IServiceCollection services)
        {
            services.AddScoped<IUserService, UserService>();

        }
    }
}
