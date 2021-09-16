# Kanban Plugin

[Kanban Plugin](https://github.com/mgmeyers/obsidian-kanban) allows creating markdown-backed Kanban boards.

## Kanban Plugin's date time format

By default, Kanban Plugin's date time format is like following:

```markdown
- [ ] Task @{2021-09-16} @@{20:26}
```

The trigger characters `@`, `@@` and date time format is customizable in Kanban Plugin's setting.

Also, Kanban Plugin supports to link dates to daily notes.

```markdown
- [ ] Task @[[2021-09-16]] @@{20:26}
```

If you enable [Kanban Plugin format setting](/setting/#enable-kanban-plugin-format), reminder plugin will recognize all of the above format based on Kanban Plugin's setting.
