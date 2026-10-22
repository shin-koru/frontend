export interface Profile {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarKey?: string;
  country?: string;
}

export interface CreateProfilePayload {
  username: string;
  firstName: string;
  lastName: string;
  country: string;
  avatarKey?: string;
}
