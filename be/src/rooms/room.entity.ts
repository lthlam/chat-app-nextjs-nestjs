import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Message } from './message.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: false })
  is_group_chat: boolean;

  @Column({ nullable: true })
  avatar_url: string;

  @ManyToOne(() => User)
  owner: User;

  @ManyToMany(() => User, { cascade: true })
  @JoinTable()
  members: User[];

  @OneToMany(() => Message, (msg) => msg.room, { cascade: true })
  messages: Message[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
