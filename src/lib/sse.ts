let clients: Array<ReadableStreamDefaultController> = [];

export function addClient(controller: ReadableStreamDefaultController) {
  clients.push(controller);
}

export function removeClient(controller: ReadableStreamDefaultController) {
  clients = clients.filter(client => client !== controller);
}

export function notifyClients(data: object) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoded = new TextEncoder().encode(message);
  
  clients = clients.filter(client => {
    try {
      client.enqueue(encoded);
      return true;
    } catch {
      return false; // Remove disconnected clients
    }
  });
}