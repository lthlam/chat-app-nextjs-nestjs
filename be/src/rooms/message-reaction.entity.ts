import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';

@Entity('message_reactions')
@Unique(['message', 'user', 'emoji'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  message: Message;

  @ManyToOne(() => User)
  user: User;

  @Column()
  emoji: string;

  @CreateDateColumn()
  created_at: Date;
}
