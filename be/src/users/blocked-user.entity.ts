import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('blocked_users')
@Unique(['blocker', 'blocked'])
export class BlockedUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  blocker: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  blocked: User;

  @CreateDateColumn()
  created_at: Date;
}
