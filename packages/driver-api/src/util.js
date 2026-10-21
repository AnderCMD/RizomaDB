export async function collect(it) {
    const columns = [];
    const rows = [];
    let done;
    for await (const ev of it) {
        if (ev.type === "columns")
            columns.push(...ev.columns);
        else if (ev.type === "rows")
            rows.push(...ev.rows);
        else if (ev.type === "done")
            done = ev;
    }
    return { columns, rows, done };
}
