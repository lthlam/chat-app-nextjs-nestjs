export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return 'Vừa mới truy cập';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Vừa mới truy cập';
  if (diffMins < 60) return `Hoạt động ${diffMins} phút trước`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `Hoạt động ${diffDays} ngày trước`;
}

export function formatLastMessageTime(dateString?: string | null): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays < 7) return `${diffDays} ngày`;
  
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
