import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/server-lookup',
  cors: {
    origin: '*',
  },
})
export class CollectionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CollectionGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Collection WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to /server-lookup namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /server-lookup: ${client.id}`);
  }

  emitItemCollected(orderId: string, orderItemId: string, status: string) {
    if (this.server) {
      this.server.emit('order:item_collected', { orderId, orderItemId, status });
      this.logger.log(`Emitted order:item_collected for order ${orderId}, item ${orderItemId}`);
    } else {
      this.logger.warn('Socket.io server not initialized yet');
    }
  }

  emitOrderCompleted(orderId: string, status: string) {
    if (this.server) {
      this.server.emit('order:completed', { orderId, status });
      this.logger.log(`Emitted order:completed for order ${orderId}`);
    } else {
      this.logger.warn('Socket.io server not initialized yet');
    }
  }
}
