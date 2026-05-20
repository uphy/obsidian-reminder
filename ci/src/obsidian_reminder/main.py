import dagger
from dagger import dag, function, object_type
from dagger.client.gen import ModuleSourceKind


@object_type
class ObsidianReminder:
    @function
    async def build(self, source_dir: dagger.Directory) -> dagger.Directory:
        """Install dependencies and build the plugin. Returns the dist directory."""
        dist_dir = (
            dag.container()
            .from_("node:21-slim")
            .with_mounted_directory("/src", source_dir)
            .with_workdir("/src")
            .with_exec(["npm", "install", "--legacy-peer-deps"])
            .with_exec(["npm", "run", "build"])
            .directory("/src/dist")
        )
        return dist_dir

    @function
    async def test(self, source_dir: dagger.Directory) -> str:
        """Run all Jest tests."""
        result = await (
            dag.container()
            .from_("node:21-slim")
            .with_mounted_directory("/src", source_dir)
            .with_workdir("/src")
            .with_exec(["npm", "install", "--legacy-peer-deps"])
            .with_exec(["npx", "jest", "--no-coverage"])
            .stdout()
        )
        return result
