using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SocialMediaPostsController : ControllerBase
{
    private readonly AppDbContext _context;

    public SocialMediaPostsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /api/socialmediaposts
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SocialMediaPost>>> GetPosts()
    {
        return await _context.SocialMediaPosts
            .OrderByDescending(p => p.PostDate)
            .ToListAsync();
    }

    // POST /api/socialmediaposts
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SocialMediaPost>> CreatePost([FromBody] SocialMediaPost post)
    {
        _context.SocialMediaPosts.Add(post);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPosts), new { id = post.PostId }, post);
    }

    // DELETE /api/socialmediaposts/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeletePost(int id)
    {
        var post = await _context.SocialMediaPosts.FindAsync(id);
        if (post == null) return NotFound();
        _context.SocialMediaPosts.Remove(post);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
