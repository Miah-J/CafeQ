import { Injectable, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export class DecryptedUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  fullName: string;
  phoneNumber: string | null;
  studentNumber: string | null;
  department: string | null;
  stationNumber: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createUser(data: {
    email: string;
    passwordHash: string;
    role: string;
    fullName: string;
    phoneNumber?: string;
    studentNumber?: string;
    department?: string;
    stationNumber?: string;
  }): Promise<DecryptedUser> {
    const cryptoKey =
      this.configService.get<string>('pgcrypto.key') || 'default_key';
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check if email already exists
      const existingUser = await queryRunner.manager.query<
        Array<{ id: string }>
      >(`SELECT id FROM users WHERE email = $1`, [data.email]);
      if (existingUser.length > 0) {
        throw new ConflictException('Email already exists');
      }

      // 2. Insert into users base table
      // CASE statement handles optional phone number to prevent pgp_sym_encrypt from throwing on null
      const userResult = await queryRunner.manager.query<Array<{ id: string }>>(
        `INSERT INTO users (email, password_hash, role, full_name, phone_number)
         VALUES ($1, $2, $3, pgp_sym_encrypt($4, $5), CASE WHEN $6::text IS NULL THEN NULL ELSE pgp_sym_encrypt($6, $5) END)
         RETURNING id`,
        [
          data.email,
          data.passwordHash,
          data.role,
          data.fullName,
          cryptoKey,
          data.phoneNumber || null,
        ],
      );

      const userId = userResult[0].id;

      // 3. Insert into role-specific tables
      if (data.role === 'Student') {
        if (!data.studentNumber) {
          throw new ConflictException(
            'Student number is required for Student role',
          );
        }

        const existingStudent = await queryRunner.manager.query<
          Array<{ id: string }>
        >(`SELECT id FROM students WHERE student_number = $1`, [
          data.studentNumber,
        ]);
        if (existingStudent.length > 0) {
          throw new ConflictException('Student number already exists');
        }

        await queryRunner.manager.query(
          `INSERT INTO students (id, student_number) VALUES ($1, $2)`,
          [userId, data.studentNumber],
        );
      } else if (data.role === 'Admin') {
        await queryRunner.manager.query(
          `INSERT INTO administrators (id, department) VALUES ($1, $2)`,
          [userId, data.department || null],
        );
      } else if (data.role === 'Cashier') {
        await queryRunner.manager.query(
          `INSERT INTO cashiers (id, station_number) VALUES ($1, $2)`,
          [userId, data.stationNumber || null],
        );
      }

      await queryRunner.commitTransaction();

      return {
        id: userId,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber || null,
        studentNumber: data.studentNumber || null,
        department: data.department || null,
        stationNumber: data.stationNumber || null,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findByEmail(email: string): Promise<DecryptedUser | null> {
    const cryptoKey =
      this.configService.get<string>('pgcrypto.key') || 'default_key';
    const userResult = await this.dataSource.query<DecryptedUser[]>(
      `SELECT u.id, u.email, u.password_hash as "passwordHash", u.role,
              pgp_sym_decrypt(u.full_name, $2) as "fullName",
              pgp_sym_decrypt(u.phone_number, $2) as "phoneNumber",
              s.student_number as "studentNumber",
              a.department,
              c.station_number as "stationNumber"
       FROM users u
       LEFT JOIN students s ON u.id = s.id
       LEFT JOIN administrators a ON u.id = a.id
       LEFT JOIN cashiers c ON u.id = c.id
       WHERE u.email = $1`,
      [email, cryptoKey],
    );

    if (userResult.length === 0) {
      return null;
    }

    return userResult[0];
  }

  async findById(id: string): Promise<DecryptedUser | null> {
    const cryptoKey =
      this.configService.get<string>('pgcrypto.key') || 'default_key';
    const userResult = await this.dataSource.query<DecryptedUser[]>(
      `SELECT u.id, u.email, u.password_hash as "passwordHash", u.role,
              pgp_sym_decrypt(u.full_name, $2) as "fullName",
              pgp_sym_decrypt(u.phone_number, $2) as "phoneNumber",
              s.student_number as "studentNumber",
              a.department,
              c.station_number as "stationNumber"
       FROM users u
       LEFT JOIN students s ON u.id = s.id
       LEFT JOIN administrators a ON u.id = a.id
       LEFT JOIN cashiers c ON u.id = c.id
       WHERE u.id = $1`,
      [id, cryptoKey],
    );

    if (userResult.length === 0) {
      return null;
    }

    return userResult[0];
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, id],
    );
  }
}
