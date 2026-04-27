import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRequest, FriendRequestStatus } from './friend-request.entity';
import { User } from '../users/user.entity';
import { MessagesGateway } from '../rooms/messages.gateway';
import { UsersService } from '../users/users.service';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendRequest)
    private friendRequestRepository: Repository<FriendRequest>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private messagesGateway: MessagesGateway,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Cannot add yourself');
    }

    const isBlocked = await this.usersService.isAnyBlocked(
      senderId,
      receiverId,
    );
    if (isBlocked) {
      throw new BadRequestException('User is blocked');
    }

    const existing = await this.friendRequestRepository.findOne({
      where: [
        { sender: { id: senderId }, receiver: { id: receiverId } },
        { sender: { id: receiverId }, receiver: { id: senderId } },
      ],
      relations: ['sender', 'receiver'],
    });

    if (existing) {
      if (existing.status === FriendRequestStatus.ACCEPTED) {
        throw new BadRequestException('Already friends');
      }

      if (existing.status === FriendRequestStatus.PENDING) {
        throw new BadRequestException('Friend request already exists');
      }

      const sender = await this.usersRepository.findOneBy({ id: senderId });
      const receiver = await this.usersRepository.findOneBy({ id: receiverId });

      existing.sender = sender;
      existing.receiver = receiver;
      existing.status = FriendRequestStatus.PENDING;
      const saved = await this.friendRequestRepository.save(existing);

      this.messagesGateway.notifyFriendRequestReceived(receiverId, {
        requestId: saved.id,
        sender: {
          id: sender.id,
          username: sender.username,
          email: sender.email,
          avatar_url: sender.avatar_url,
          status: sender.status,
        },
        created_at: saved.created_at,
      });

      return saved;
    }

    const sender = await this.usersRepository.findOneBy({ id: senderId });
    const receiver = await this.usersRepository.findOneBy({ id: receiverId });

    const request = this.friendRequestRepository.create({
      sender,
      receiver,
    });

    const saved = await this.friendRequestRepository.save(request);

    this.messagesGateway.notifyFriendRequestReceived(receiverId, {
      requestId: saved.id,
      sender: {
        id: sender.id,
        username: sender.username,
        email: sender.email,
        avatar_url: sender.avatar_url,
        status: sender.status,
      },
      created_at: saved.created_at,
    });

    return saved;
  }

  async acceptFriendRequest(requestId: string, currentUserId: string) {
    const request = await this.friendRequestRepository.findOne({
      where: { id: requestId },
      relations: ['sender', 'receiver'],
    });

    if (!request) {
      throw new BadRequestException('Friend request not found');
    }

    if (String(request.receiver?.id) !== String(currentUserId)) {
      throw new BadRequestException('You cannot accept this friend request');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Friend request is no longer pending');
    }

    request.status = FriendRequestStatus.ACCEPTED;
    const savedRequest = await this.friendRequestRepository.save(request);

    const senderSummary = {
      id: request.sender.id,
      username: request.sender.username,
      email: request.sender.email,
      avatar_url: request.sender.avatar_url,
      status: request.sender.status,
    };
    const receiverSummary = {
      id: request.receiver.id,
      username: request.receiver.username,
      email: request.receiver.email,
      avatar_url: request.receiver.avatar_url,
      status: request.receiver.status,
    };

    this.messagesGateway.notifyFriendRequestAccepted(request.sender.id, {
      requestId: savedRequest.id,
      friend: receiverSummary,
    });
    this.messagesGateway.notifyFriendRequestAccepted(request.receiver.id, {
      requestId: savedRequest.id,
      friend: senderSummary,
    });

    return savedRequest;
  }

  async rejectFriendRequest(requestId: string) {
    const request = await this.friendRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new BadRequestException('Friend request not found');
    }

    request.status = FriendRequestStatus.REJECTED;
    return this.friendRequestRepository.save(request);
  }

  async getPendingRequests(userId: string) {
    return this.friendRequestRepository.find({
      where: {
        receiver: { id: userId },
        status: FriendRequestStatus.PENDING,
      },
      relations: ['sender', 'receiver'],
    });
  }

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const request = await this.friendRequestRepository.findOne({
      where: [
        {
          sender: { id: userId1 },
          receiver: { id: userId2 },
          status: FriendRequestStatus.ACCEPTED,
        },
        {
          sender: { id: userId2 },
          receiver: { id: userId1 },
          status: FriendRequestStatus.ACCEPTED,
        },
      ],
    });

    return !!request;
  }

  async getFriendList(userId: string) {
    const requests = await this.friendRequestRepository.find({
      where: { status: FriendRequestStatus.ACCEPTED },
      relations: ['sender', 'receiver'],
    });

    return requests
      .filter((r) => r.sender.id === userId || r.receiver.id === userId)
      .map((r) => (r.sender.id === userId ? r.receiver : r.sender));
  }

  async removeFriend(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    const request = await this.friendRequestRepository.findOne({
      where: [
        {
          sender: { id: userId },
          receiver: { id: targetUserId },
          status: FriendRequestStatus.ACCEPTED,
        },
        {
          sender: { id: targetUserId },
          receiver: { id: userId },
          status: FriendRequestStatus.ACCEPTED,
        },
      ],
    });

    if (!request) {
      throw new BadRequestException('Friend relationship not found');
    }

    await this.friendRequestRepository.remove(request);

    this.messagesGateway.notifyFriendRemoved(userId, targetUserId);
    this.messagesGateway.notifyFriendRemoved(targetUserId, userId);

    return { message: 'Friend removed successfully' };
  }

  async getFriendshipStatus(userId: string, targetUserId: string) {
    const request = await this.friendRequestRepository.findOne({
      where: [
        { sender: { id: userId }, receiver: { id: targetUserId } },
        { sender: { id: targetUserId }, receiver: { id: userId } },
      ],
    });

    if (!request) {
      return { isFriend: false, isPending: false };
    }

    return {
      isFriend: request.status === FriendRequestStatus.ACCEPTED,
      isPending: request.status === FriendRequestStatus.PENDING,
    };
  }
}
