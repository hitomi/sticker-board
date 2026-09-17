export function startupMessage(message: string) {
  const element = document.getElementById("boot-message");
  if (element) element.textContent = message;
}

export function finishStartup() {
  window.dispatchEvent(new Event("sticker-ready"));
}

export function paintStartup() {
  // Yield before parsing. Do not wait on animation frames: WebKit can defer
  // them while a streamed document is still downloading.
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
