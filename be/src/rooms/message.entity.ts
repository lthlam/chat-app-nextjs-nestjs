import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Room } from './room.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageRead } from './message-read.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Room, (room) => room.messages, { onDelete: 'CASCADE' })
  room: Room;

  @ManyToOne(() => User)
  sender: User;

  @Column()
  content: string;

  @Column({
    type: 'enum',
    enum: ['text', 'image', 'call', 'voice', 'album', 'video', 'location'],
    default: 'text',
  })
  type: 'text' | 'image' | 'call' | 'voice' | 'album' | 'video' | 'location';

  @Column({ nullable: true })
  delivered_at: Date;

  @Column({ default: false })
  is_pinned: boolean;

  @Column({ nullable: true })
  deleted_at: Date;

  @ManyToOne(() => Message, (message) => message.replies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  reply_to: Message;

  @OneToMany(() => Message, (message) => message.reply_to)
  replies: Message[];

  @OneToMany(() => MessageReaction, (reaction) => reaction.message, {
    cascade: true,
  })
  reactions: MessageReaction[];

  @OneToMany(() => MessageRead, (read) => read.message, { cascade: true })
  reads: MessageRead[];

  @Column({ default: false })
  is_forwarded: boolean;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'message_mentions',
    joinColumn: { name: 'message_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  mentions: User[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({
    type: 'tsvector',
    select: false,
    generatedType: 'STORED',
    asExpression: `to_tsvector('simple', public.f_unaccent(case when type = 'text' then coalesce(content, '') else '' end))`,
  })
  search_vector: string;
}
