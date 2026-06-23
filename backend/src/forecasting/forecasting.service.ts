import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('FORECASTING_SERVICE_URL') || 'http://localhost:8000';
  }

  async getRecommendedQuantities(dishNames: string[]): Promise<Record<string, number>> {
    if (dishNames.length === 0) return {};

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: todayStr,
          dishes: dishNames,
        }),
      });

      if (!res.ok) {
        throw new Error(`Forecasting API returned status: ${res.status}`);
      }

      const data = await res.json() as { status: string; predictions: Record<string, number> };
      if (data.status === 'success' && data.predictions) {
        return data.predictions;
      }
      return {};
    } catch (err: any) {
      this.logger.error(`Failed to fetch forecast from microservice: ${err.message}`);
      // Fallback: return a default recommendation (e.g., 50 portions per dish) if the microservice is offline
      const fallback: Record<string, number> = {};
      for (const name of dishNames) {
        fallback[name] = 50;
      }
      return fallback;
    }
  }
}
