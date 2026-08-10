const release = "0.10.0";
const payloads = Array.from({ length: 5 }, (_, index) =>
  `/assets/arcade.part${String(index).padStart(2, "0")}.b64?v=${release}`
);

Promise.all(
  payloads.map(async (path) => {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    const binary = atob((await response.text()).trim());
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  })
)
  .then((parts) => {
    const moduleUrl = URL.createObjectURL(new Blob(parts, { type: "text/javascript" }));
    return import(moduleUrl).finally(() => URL.revokeObjectURL(moduleUrl));
  })
  .catch((error) => {
    console.error(error);
    const root = document.querySelector("#root");
    if (root) root.innerHTML = "<main style='min-height:100vh;display:grid;place-content:center;background:#07080d;color:#f5f4ef;font:16px system-ui;text-align:center;padding:24px'><h1>Arcade loading failed.</h1><p>Please refresh the page.</p></main>";
  });
