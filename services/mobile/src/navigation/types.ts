export type LibraryStackParamList = {
  LibraryHome: undefined;
  Reader: { bookId: string; bookTitle: string };
};

export type ClubsStackParamList = {
  ClubsHome: undefined;
  ClubDetail: { clubId: string; clubName: string };
  LiveSession: { clubId: string; sessionId: string; sessionTitle: string };
};

export type RootTabParamList = {
  Library: undefined;
  Clubs: undefined;
  Fragments: undefined;
  Account: undefined;
};
