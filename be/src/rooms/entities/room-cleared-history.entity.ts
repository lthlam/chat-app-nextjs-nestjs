import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../users/user.entity';
import { Room } from '../room.entity';

@Entity('room_cleared_history')
export class RoomClearedHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'timestamp' })
  cleared_at: Date;
}
