const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { processReservation, getProcessingStats } = require('./processing-service');

const {
  getStatus,
  reserve,
  reset,
} = require('./reservation-service');

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  res.end(JSON.stringify(data));
}

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  const hostname = os.hostname();

  try {
    // Frontend
    if (req.method === 'GET' && staticFiles[req.url]) {
      const [filename, contentType] = staticFiles[req.url];
      const filePath = path.join(__dirname, '..', 'public', filename);

      const content = await fs.promises.readFile(filePath);

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      });

      return res.end(content);
    }

    // Health check
    if (req.method === 'GET' && req.url === '/ping') {
      return sendJson(res, 200, {
        message: 'TicketRush está funcionando',
        hostname,
      });
    }

    if (req.method === 'GET' && req.url === '/workers/status') {
      return sendJson(res, 200, { ...getProcessingStats(), hostname });
    }

    if (req.method === 'POST' && req.url === '/benchmark/cpu') {
      const processing = await processReservation(crypto.randomUUID());
      return sendJson(res, 200, { ...processing, hostname });
    }

    // Reservation status
    if (req.method === 'GET' && req.url === '/status') {
      return sendJson(res, 200, {
        ...await getStatus(),
        hostname,
      });
    }

    // Create reservation
    if (req.method === 'POST' && req.url === '/reserve') {
      const result = await reserve();
    
      if (!result.success) {
        return sendJson(res, 409, {
          ...result,
          hostname,
        });
      }
    
      const reservationId = crypto.randomUUID();
      const processing = await processReservation(reservationId);
    
      return sendJson(res, 201, {
        ...result,
        reservationId,
        processing,
        hostname,
      });
    }

    // Reset reservations
    if (req.method === 'POST' && req.url === '/reset') {
      const result = await reset();

      return sendJson(res, 200, {
        ...result,
        hostname,
      });
    }

    return sendJson(res, 404, {
      message: 'Ruta no encontrada',
    });
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      return sendJson(res, 500, {
        message: 'Error interno del servidor',
      });
    }

    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`TicketRush ejecutándose en el puerto ${PORT}`);
});

