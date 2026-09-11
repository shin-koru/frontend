export interface Profile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  accountKey: string;
  country: string;
}

export type CreateProfilePayload = Omit<Profile, 'id' | 'accountKey'>;
