# Documentation

See the main [README.md](../README.md) for project setup and usage.

## Additional Resources

- [Ralph pattern](https://ghuntley.com/ralph/) - The autonomous development approach used in this project
- [Ralph Playbook](https://github.com/ClaytonFarr/ralph-playbook) - Detailed guide to the Ralph pattern
- [Reddit API docs](https://www.reddit.com/dev/api/) - Reddit API reference
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM documentation
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

## Specs

The `/specs` directory contains requirements documents, one per topic of concern:

| Spec | Purpose |
|------|---------|
| `project-setup.md` | Dependencies, tooling, configuration |
| `database-schema.md` | Drizzle schema, migrations, seeding |
| `reddit-integration.md` | Reddit API client, auth, fetching |
| `subreddit-configuration.md` | Managing monitored subreddits |
| `tag-system.md` | Tags and search terms |
| `post-management.md` | Post lifecycle (new/ignored/done) |
| `ui-components.md` | React UI, layout, components |
| `llm-tag-suggestions.md` | Groq integration for smart suggestions |

Each spec includes acceptance criteria that drive test requirements.
