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
  namespace: '/kitchen',
  cors: {
    origin: '*',
  },
})
export class KitchenGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(KitchenGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Kitchen WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to /kitchen namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /kitchen: ${client.id}`);
  }

  emitDishUpdated(payload: {
    dishId: string;
    dish_id: string;
    confirmedOrderCount: number;
    confirmed_order_count: number;
    preparedQuantity: number;
    prepared_quantity: number;
    isSoldOut: boolean;
    is_sold_out: boolean;
  }) {
    if (this.server) {
      this.server.emit('dish:updated', payload);
      this.logger.log(
        `Emitted dish:updated for dish ${payload.dishId}. Confirmed count: ${payload.confirmedOrderCount}`,
      );
    } else {
      this.logger.warn('Socket.io server not initialized yet');
    }
  }
}
