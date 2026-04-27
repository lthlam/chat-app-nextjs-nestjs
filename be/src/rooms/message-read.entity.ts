import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';

@Entity('message_reads')
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.reads, { onDelete: 'CASCADE' })
  message: Message;

  @ManyToOne(() => User)
  user: User;

  @CreateDateColumn()
  read_at: Date;
}
