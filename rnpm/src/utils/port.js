import net from "net"

export function isPortOpen(port, host = "localhost", timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket()

    socket.setTimeout(timeout)

    socket.on("connect", () => {
      socket.destroy()
      resolve(true)
    })

    socket.on("error", () => {
      resolve(false)
    })

    socket.on("timeout", () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(port, host)
  })
}

export async function waitForPort(port, retries = 5) {
  for (let i = 0; i < retries; i++) {
    if (await isPortOpen(port)) return true
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Port ${port} is not open`)
}
