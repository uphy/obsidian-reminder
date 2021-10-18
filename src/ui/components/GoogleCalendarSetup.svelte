<script lang="typescript">
    export let authUrl: string;
    export let authorize: (code: string, calendarId: string) => Promise<void>;

    let code: string = "";
    let calendarId: string = "";
    let error: unknown;
    async function onClick() {
        try {
            await authorize(code, calendarId);
            error = undefined;
        } catch (ex) {
            error = ex;
            console.error(ex);
        }
    }
</script>

<main>
    <span>
        Open the <a href={authUrl}>URL</a> and permit our access to the Google Calendar
        API. After you got the authorization code, please copy it to the following
        text field.
    </span>
    <div>Authorization Code: <input type="text" bind:value={code} /></div>
    <div>Calendar ID: <input type="text" bind:value={calendarId} /></div>
    <div><input type="button" on:click={onClick} value="OK" /></div>
    {#if error}
        <span class="error">{error}</span>
    {/if}
</main>

<style>
    .error {
        color: var(--text-error);
    }
</style>
